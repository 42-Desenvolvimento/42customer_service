jest.mock("bull", () => jest.fn());

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

import BullQueues from "bull";
import AppError from "../../../errors/AppError";
import Campaign from "../../../models/Campaign";
import CampaignContacts from "../../../models/CampaignContacts";
import CancelCampaignService from "../../../services/CampaignServices/CancelCampaignService";

describe("CancelCampaignService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      IO_REDIS_PORT: "6380",
      IO_REDIS_SERVER: "redis.local",
      IO_REDIS_DB_SESSION: "4",
      IO_REDIS_PASSWORD: "redis-password"
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("removes campaign jobs, resets pending contacts and marks the campaign as canceled", async () => {
    const removeJobs = jest.fn().mockResolvedValue(undefined);
    const campaign = {
      id: 123,
      update: jest.fn().mockResolvedValue(undefined)
    };

    (BullQueues as unknown as jest.Mock).mockReturnValue({ removeJobs });
    (Campaign.findOne as jest.Mock).mockResolvedValue(campaign);
    (CampaignContacts.update as jest.Mock).mockResolvedValue([2]);

    await CancelCampaignService({ campaignId: "123", tenantId: "9" });

    expect(Campaign.findOne).toHaveBeenCalledWith({
      where: { id: "123", tenantId: "9" }
    });
    expect(BullQueues).toHaveBeenCalledWith("SendMessageWhatsappCampaign", {
      redis: {
        port: 6380,
        host: "redis.local",
        db: 4,
        password: "redis-password"
      }
    });
    expect(removeJobs).toHaveBeenCalledWith("campaginId_123*");
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

  it("throws when the campaign does not belong to the tenant", async () => {
    (Campaign.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      CancelCampaignService({ campaignId: 123, tenantId: 9 })
    ).rejects.toMatchObject({
      message: "ERROR_CAMPAIGN_NOT_EXISTS",
      statusCode: 404
    });
  });

  it("does not reset contacts or cancel the campaign when job removal fails", async () => {
    const removeJobs = jest.fn().mockRejectedValue(new Error("queue down"));
    const campaign = {
      id: 123,
      update: jest.fn()
    };

    (BullQueues as unknown as jest.Mock).mockReturnValue({ removeJobs });
    (Campaign.findOne as jest.Mock).mockResolvedValue(campaign);

    await expect(
      CancelCampaignService({ campaignId: 123, tenantId: 9 })
    ).rejects.toBeInstanceOf(AppError);

    expect(CampaignContacts.update).not.toHaveBeenCalled();
    expect(campaign.update).not.toHaveBeenCalled();
  });
});
