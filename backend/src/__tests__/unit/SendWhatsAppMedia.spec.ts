jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));
jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));
jest.mock("../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../models/UserMessagesLog", () => ({
  create: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));
jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the WhatsApp session before returning a send failure", async () => {
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = {
      id: 22,
      whatsappId: 11,
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/audio.ogg",
      filename: "audio.ogg"
    };
    const newMedia = { mimetype: "audio/ogg" };

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(newMedia);

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: 5
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@c.us",
      newMedia,
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
