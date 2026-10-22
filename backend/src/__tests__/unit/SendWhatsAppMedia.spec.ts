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
  __esModule: true,
  default: {
    create: jest.fn()
  }
}));

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../utils/logger";

describe("SendWhatsAppMedia", () => {
  it("starts WhatsApp session verification before rethrowing send errors", async () => {
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = {
      id: 7,
      whatsappId: 22,
      isGroup: true,
      contact: {
        number: "5511987654321"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/audio.ogg",
      filename: "audio.ogg"
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: 44
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511987654321@g.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(22, sendError);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
    expect(ticket.update).not.toHaveBeenCalled();
  });
});
