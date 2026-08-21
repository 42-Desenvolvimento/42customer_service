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

const bullQueuesMock = BullQueues as unknown as jest.Mock;
const campaignMock = Campaign as unknown as { findOne: jest.Mock };
const campaignContactsMock = CampaignContacts as unknown as {
  update: jest.Mock;
};

describe("CancelCampaignService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.IO_REDIS_PORT = "6379";
    process.env.IO_REDIS_SERVER = "redis";
    process.env.IO_REDIS_DB_SESSION = "5";
    process.env.IO_REDIS_PASSWORD = "";
  });

  it("removes campaign jobs, clears pending contacts and marks the campaign as canceled", async () => {
    const removeJobs = jest.fn().mockResolvedValue(undefined);
    const updateCampaign = jest.fn().mockResolvedValue(undefined);

    bullQueuesMock.mockReturnValue({ removeJobs });
    campaignMock.findOne.mockResolvedValue({
      id: 42,
      update: updateCampaign
    });
    campaignContactsMock.update.mockResolvedValue([3]);

    await CancelCampaignService({ campaignId: "42", tenantId: 7 });

    expect(campaignMock.findOne).toHaveBeenCalledWith({
      where: { id: "42", tenantId: 7 }
    });
    expect(bullQueuesMock).toHaveBeenCalledWith("SendMessageWhatsappCampaign", {
      redis: {
        port: 6379,
        host: "redis",
        db: 5,
        password: undefined
      }
    });
    expect(removeJobs).toHaveBeenCalledWith("campaginId_42*");
    expect(campaignContactsMock.update).toHaveBeenCalledWith(
      {
        body: null,
        mediaName: null,
        timestamp: null,
        ack: 0,
        messageId: null
      },
      {
        where: {
          campaignId: 42,
          messageId: null
        }
      }
    );
    expect(updateCampaign).toHaveBeenCalledWith({ status: "canceled" });
  });

  it("throws a not found error without touching queues when the campaign does not exist", async () => {
    campaignMock.findOne.mockResolvedValue(null);

    await expect(
      CancelCampaignService({ campaignId: 99, tenantId: 7 })
    ).rejects.toMatchObject({
      message: "ERROR_CAMPAIGN_NOT_EXISTS",
      statusCode: 404
    });

    expect(bullQueuesMock).not.toHaveBeenCalled();
    expect(campaignContactsMock.update).not.toHaveBeenCalled();
  });

  it("does not clear contacts or update campaign status when job removal fails", async () => {
    const removeJobs = jest.fn().mockRejectedValue(new Error("redis down"));
    const updateCampaign = jest.fn();

    bullQueuesMock.mockReturnValue({ removeJobs });
    campaignMock.findOne.mockResolvedValue({
      id: 42,
      update: updateCampaign
    });

    await expect(
      CancelCampaignService({ campaignId: 42, tenantId: 7 })
    ).rejects.toBeInstanceOf(AppError);

    expect(campaignContactsMock.update).not.toHaveBeenCalled();
    expect(updateCampaign).not.toHaveBeenCalled();
  });
});
