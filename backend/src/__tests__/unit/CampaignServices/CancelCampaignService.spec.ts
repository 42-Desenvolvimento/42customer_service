const mockRemoveJobs = jest.fn();
const mockBullQueues = jest.fn(() => ({
  removeJobs: mockRemoveJobs
}));

const mockCampaignFindOne = jest.fn();
const mockCampaignContactsUpdate = jest.fn();

jest.mock("bull", () => mockBullQueues);

jest.mock("../../../models/Campaign", () => ({
  __esModule: true,
  default: {
    findOne: mockCampaignFindOne
  }
}));

jest.mock("../../../models/CampaignContacts", () => ({
  __esModule: true,
  default: {
    update: mockCampaignContactsUpdate
  }
}));

import CancelCampaignService from "../../../services/CampaignServices/CancelCampaignService";

describe("CancelCampaignService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      IO_REDIS_PORT: "6379",
      IO_REDIS_SERVER: "redis",
      IO_REDIS_DB_SESSION: "5",
      IO_REDIS_PASSWORD: "redis-password"
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("cancela a campanha, remove jobs pendentes e reseta somente contatos sem messageId", async () => {
    const campaignUpdate = jest.fn().mockResolvedValue(undefined);
    mockCampaignFindOne.mockResolvedValue({
      id: 123,
      update: campaignUpdate
    });
    mockRemoveJobs.mockResolvedValue(undefined);
    mockCampaignContactsUpdate.mockResolvedValue([2]);

    await CancelCampaignService({ campaignId: "123", tenantId: "7" });

    expect(mockCampaignFindOne).toHaveBeenCalledWith({
      where: { id: "123", tenantId: "7" }
    });
    expect(mockBullQueues).toHaveBeenCalledWith("SendMessageWhatsappCampaign", {
      redis: {
        port: 6379,
        host: "redis",
        db: 5,
        password: "redis-password"
      }
    });
    expect(mockRemoveJobs).toHaveBeenCalledWith("campaginId_123*");
    expect(mockCampaignContactsUpdate).toHaveBeenCalledWith(
      {
        body: null,
        mediaName: null,
        timestamp: null,
        ack: 0,
        messageId: null
      },
      {
        where: {
          campaignId: 123,
          messageId: null
        }
      }
    );
    expect(campaignUpdate).toHaveBeenCalledWith({ status: "canceled" });
  });

  it("falha com AppError quando a campanha nao existe", async () => {
    mockCampaignFindOne.mockResolvedValue(null);

    await expect(
      CancelCampaignService({ campaignId: 999, tenantId: 7 })
    ).rejects.toMatchObject({
      message: "ERROR_CAMPAIGN_NOT_EXISTS",
      statusCode: 404
    });

    expect(mockBullQueues).not.toHaveBeenCalled();
    expect(mockCampaignContactsUpdate).not.toHaveBeenCalled();
  });

  it("propaga falhas da fila sem marcar a campanha como cancelada", async () => {
    const campaignUpdate = jest.fn();
    mockCampaignFindOne.mockResolvedValue({
      id: 321,
      update: campaignUpdate
    });
    mockRemoveJobs.mockRejectedValue(new Error("redis offline"));

    await expect(
      CancelCampaignService({ campaignId: 321, tenantId: 7 })
    ).rejects.toMatchObject({
      message: "ERROR: Error: redis offline",
      statusCode: 404
    });

    expect(mockCampaignContactsUpdate).not.toHaveBeenCalled();
    expect(campaignUpdate).not.toHaveBeenCalled();
  });
});
