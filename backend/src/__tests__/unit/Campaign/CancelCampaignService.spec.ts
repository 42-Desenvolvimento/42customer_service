import BullQueues from "bull";
import Campaign from "../../../models/Campaign";
import CampaignContacts from "../../../models/CampaignContacts";
import CancelCampaignService from "../../../services/CampaignServices/CancelCampaignService";

const mockRemoveJobs = jest.fn();

jest.mock("bull", () => jest.fn(() => ({ removeJobs: mockRemoveJobs })));

jest.mock("../../../models/Campaign", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn()
  }
}));

jest.mock("../../../models/CampaignContacts", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

describe("CancelCampaignService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      IO_REDIS_PORT: "6380",
      IO_REDIS_SERVER: "queue-redis",
      IO_REDIS_PASSWORD: "redis-password",
      IO_REDIS_DB_SESSION: "2"
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("removes scheduled campaign jobs from the campaign queue redis database", async () => {
    const campaign = {
      id: 123,
      update: jest.fn().mockResolvedValue(undefined)
    };

    (Campaign.findOne as jest.Mock).mockResolvedValue(campaign);
    (CampaignContacts.update as jest.Mock).mockResolvedValue([1]);
    mockRemoveJobs.mockResolvedValue(undefined);

    await CancelCampaignService({ campaignId: campaign.id, tenantId: 7 });

    expect(BullQueues).toHaveBeenCalledWith("SendMessageWhatsappCampaign", {
      redis: {
        host: "queue-redis",
        port: 6380,
        password: "redis-password",
        db: 3
      }
    });
    expect(mockRemoveJobs).toHaveBeenCalledWith(`campaginId_${campaign.id}*`);
    expect(
      mockRemoveJobs.mock.invocationCallOrder[0]
    ).toBeLessThan(campaign.update.mock.invocationCallOrder[0]);
    expect(campaign.update).toHaveBeenCalledWith({ status: "canceled" });
  });
});
