import BullQueues from "bull";
import CancelCampaignService from "../../../services/CampaignServices/CancelCampaignService";
import Campaign from "../../../models/Campaign";
import CampaignContacts from "../../../models/CampaignContacts";

jest.mock("bull", () => ({
  __esModule: true,
  default: jest.fn()
}));

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
  const bullQueuesMock = BullQueues as unknown as jest.Mock;
  const campaignFindOneMock = Campaign.findOne as jest.Mock;
  const campaignContactsUpdateMock = CampaignContacts.update as jest.Mock;
  const removeJobsMock = jest.fn();
  const campaignUpdateMock = jest.fn();

  beforeEach(() => {
    bullQueuesMock.mockReturnValue({
      removeJobs: removeJobsMock
    });
    campaignFindOneMock.mockResolvedValue({
      id: 42,
      update: campaignUpdateMock
    });
  });

  it("should cancel campaign jobs and reset only unsent campaign contacts", async () => {
    await CancelCampaignService({
      campaignId: 42,
      tenantId: 7
    });

    expect(campaignFindOneMock).toHaveBeenCalledWith({
      where: { id: 42, tenantId: 7 }
    });
    expect(bullQueuesMock).toHaveBeenCalledWith("SendMessageWhatsappCampaign", {
      redis: {
        port: Number(process.env.IO_REDIS_PORT),
        host: process.env.IO_REDIS_SERVER,
        db: Number(process.env.IO_REDIS_DB_SESSION) || 2,
        password: process.env.IO_REDIS_PASSWORD || undefined
      }
    });
    expect(removeJobsMock).toHaveBeenCalledWith("campaginId_42*");
    expect(campaignContactsUpdateMock).toHaveBeenCalledWith(
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
    expect(campaignUpdateMock).toHaveBeenCalledWith({
      status: "canceled"
    });
  });

  it("should reject when campaign does not exist", async () => {
    campaignFindOneMock.mockResolvedValueOnce(null);

    await expect(
      CancelCampaignService({
        campaignId: "missing-campaign",
        tenantId: "tenant"
      })
    ).rejects.toMatchObject({
      message: "ERROR_CAMPAIGN_NOT_EXISTS",
      statusCode: 404
    });

    expect(removeJobsMock).not.toHaveBeenCalled();
    expect(campaignContactsUpdateMock).not.toHaveBeenCalled();
    expect(campaignUpdateMock).not.toHaveBeenCalled();
  });

  it("should not reset contacts or update campaign status when queued job removal fails", async () => {
    const removeJobsError = new Error("redis unavailable");
    removeJobsMock.mockRejectedValueOnce(removeJobsError);

    await expect(
      CancelCampaignService({
        campaignId: 42,
        tenantId: 7
      })
    ).rejects.toMatchObject({
      message: `ERROR: ${removeJobsError}`,
      statusCode: 404
    });

    expect(campaignContactsUpdateMock).not.toHaveBeenCalled();
    expect(campaignUpdateMock).not.toHaveBeenCalled();
  });
});
