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

import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the WhatsApp session before returning the send-media error", async () => {
    const sendError = new Error("invalid wid");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = {
      id: 123,
      whatsappId: 99,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/audio.ogg",
      filename: "audio.ogg"
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue("media-content");

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: 5
      })
    ).rejects.toMatchObject({ message: "ERR_SENDING_WAPP_MSG" });

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      "media-content",
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(99, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
  });
});
