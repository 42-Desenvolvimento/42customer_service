import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../models/UserMessagesLog", () => ({
  create: jest.fn()
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

const mockGetTicketWbot = GetTicketWbot as jest.MockedFunction<
  typeof GetTicketWbot
>;
const mockFromFilePath = MessageMedia.fromFilePath as jest.Mock;
const mockUserMessagesLogCreate = UserMessagesLog.create as jest.Mock;
const mockUnlinkSync = fs.unlinkSync as jest.Mock;
const mockStartWhatsAppSessionVerify =
  StartWhatsAppSessionVerify as jest.MockedFunction<
    typeof StartWhatsAppSessionVerify
  >;

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify the whatsapp session when media delivery fails", async () => {
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    mockGetTicketWbot.mockResolvedValue({ sendMessage } as any);
    mockFromFilePath.mockReturnValue({ mimetype: "image/png" });

    const ticket = {
      id: 10,
      whatsappId: 42,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    } as any;
    const media = {
      path: "/tmp/file.png",
      filename: "file.png"
    } as Express.Multer.File;

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 7 })
    ).rejects.toMatchObject(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "image/png" },
      { sendAudioAsVoice: true }
    );
    expect(mockStartWhatsAppSessionVerify).toHaveBeenCalledWith(42, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockUserMessagesLogCreate).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
