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
  __esModule: true,
  default: {
    create: jest.fn()
  }
}));
jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify the WhatsApp session and raise AppError when media sending fails", async () => {
    const sendError = new Error("session closed");
    const mediaPayload = { mimetype: "image/png" };
    const media = {
      path: "/tmp/media.png",
      filename: "media.png"
    } as Express.Multer.File;
    const ticket = {
      id: 15,
      whatsappId: 33,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    };
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(mediaPayload);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket: ticket as any,
        userId: 9
      })
    ).rejects.toMatchObject(new AppError("ERR_SENDING_WAPP_MSG"));

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/media.png");
    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(33, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
