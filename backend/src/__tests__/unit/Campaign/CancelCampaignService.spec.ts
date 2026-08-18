const mockRemoveJobs = jest.fn();
const mockFindOne = jest.fn();
const mockCampaignContactsUpdate = jest.fn();

jest.mock("bull", () =>
  jest.fn(() => ({
    removeJobs: mockRemoveJobs
  }))
);

jest.mock("../../../models/Campaign", () => ({
  __esModule: true,
  default: {
    findOne: mockFindOne
  }
}));

jest.mock("../../../models/CampaignContacts", () => ({
  __esModule: true,
  default: {
    update: mockCampaignContactsUpdate
  }
}));

import BullQueues from "bull";
import CancelCampaignService from "../../../services/CampaignServices/CancelCampaignService";

const mockedBullQueues = BullQueues as jest.Mock;

describe("CancelCampaignService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      IO_REDIS_PORT: "6380",
      IO_REDIS_SERVER: "redis",
      IO_REDIS_DB_SESSION: "2",
      IO_REDIS_PASSWORD: ""
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("removes campaign jobs from the queue database used for scheduling", async () => {
    const campaign = {
      id: 42,
      update: jest.fn().mockResolvedValue(undefined)
    };
    mockFindOne.mockResolvedValue(campaign);

    await CancelCampaignService({ campaignId: campaign.id, tenantId: 1 });

    expect(mockedBullQueues).toHaveBeenCalledWith("SendMessageWhatsappCampaign", {
      redis: {
        port: 6380,
        host: "redis",
        db: 3,
        password: undefined
      }
    });
    expect(mockRemoveJobs).toHaveBeenCalledWith("campaginId_42*");
    expect(campaign.update).toHaveBeenCalledWith({ status: "canceled" });
  });
});
