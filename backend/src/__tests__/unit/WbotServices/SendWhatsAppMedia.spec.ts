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
jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));
jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("tries to restart the WhatsApp session and surfaces a send error when media sending fails", async () => {
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const mediaPayload = { mimetype: "image/png" };
    const ticket = {
      id: 10,
      whatsappId: 30,
      isGroup: true,
      contact: {
        number: "5551999999999"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/media.png",
      filename: "media.png"
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(mediaPayload);

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: 99
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "5551999999999@g.us",
      mediaPayload,
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(30, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
