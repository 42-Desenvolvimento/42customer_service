const mockRemoveJobs = jest.fn();

jest.mock("bull", () =>
  jest.fn(() => ({
    removeJobs: mockRemoveJobs
  }))
);

jest.mock("../../../models/Campaign", () => ({
  findOne: jest.fn()
}));

jest.mock("../../../models/CampaignContacts", () => ({
  update: jest.fn()
}));

import BullQueues from "bull";
import AppError from "../../../errors/AppError";
import Campaign from "../../../models/Campaign";
import CampaignContacts from "../../../models/CampaignContacts";
import CancelCampaignService from "../../../services/CampaignServices/CancelCampaignService";

describe("CancelCampaignService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      IO_REDIS_PORT: "6380",
      IO_REDIS_SERVER: "redis.internal",
      IO_REDIS_DB_SESSION: "7",
      IO_REDIS_PASSWORD: "test-password"
    };
    mockRemoveJobs.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("removes jobs from the campaign queue and resets only unsent contacts", async () => {
    const campaign = {
      id: 123,
      update: jest.fn().mockResolvedValue(undefined)
    };
    (Campaign.findOne as jest.Mock).mockResolvedValue(campaign);
    (CampaignContacts.update as jest.Mock).mockResolvedValue([2]);

    await CancelCampaignService({
      campaignId: "123",
      tenantId: "tenant-1"
    });

    expect(Campaign.findOne).toHaveBeenCalledWith({
      where: { id: "123", tenantId: "tenant-1" }
    });
    expect(BullQueues).toHaveBeenCalledWith("SendMessageWhatsappCampaign", {
      redis: {
        port: 6380,
        host: "redis.internal",
        db: 7,
        password: "test-password"
      }
    });
    expect(mockRemoveJobs).toHaveBeenCalledWith("campaginId_123*");
    expect(CampaignContacts.update).toHaveBeenCalledWith(
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
    expect(campaign.update).toHaveBeenCalledWith({ status: "canceled" });
  });

  it("throws when the campaign does not exist", async () => {
    (Campaign.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      CancelCampaignService({
        campaignId: "999",
        tenantId: "tenant-1"
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(BullQueues).not.toHaveBeenCalled();
    expect(CampaignContacts.update).not.toHaveBeenCalled();
  });

  it("does not reset contacts or cancel the campaign when job removal fails", async () => {
    const campaign = {
      id: 123,
      update: jest.fn().mockResolvedValue(undefined)
    };
    (Campaign.findOne as jest.Mock).mockResolvedValue(campaign);
    mockRemoveJobs.mockRejectedValue(new Error("redis offline"));

    await expect(
      CancelCampaignService({
        campaignId: 123,
        tenantId: 1
      })
    ).rejects.toMatchObject({
      message: "ERROR: Error: redis offline",
      statusCode: 404
    });

    expect(CampaignContacts.update).not.toHaveBeenCalled();
    expect(campaign.update).not.toHaveBeenCalled();
  });
});
