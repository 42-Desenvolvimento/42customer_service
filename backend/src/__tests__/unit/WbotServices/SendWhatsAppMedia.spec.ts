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

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { logger } from "../../../utils/logger";

describe("WbotServices/SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify the WhatsApp session before throwing when media sending fails", async () => {
    const sendError = new Error("send failed");
    const mediaContent = { mimetype: "image/png", data: "encoded" };
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = {
      id: 123,
      whatsappId: 456,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    } as any;
    const media = {
      path: "/tmp/avatar.png",
      filename: "avatar.png"
    } as Express.Multer.File;

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(mediaContent);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 77
      })
    ).rejects.toMatchObject({ message: "ERR_SENDING_WAPP_MSG" });

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/avatar.png");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      mediaContent,
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(456, sendError);
    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
