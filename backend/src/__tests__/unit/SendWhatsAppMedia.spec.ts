jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));
jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));
jest.mock("../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../models/UserMessagesLog", () => ({
  __esModule: true,
  default: {
    create: jest.fn()
  }
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

  it("verifies the WhatsApp session before throwing when media sending fails", async () => {
    const sendError = new Error("session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "image/png"
    });

    const ticket = {
      id: 10,
      whatsappId: 99,
      isGroup: false,
      contact: {
        number: "5551999999999"
      },
      update: jest.fn()
    };
    const media = {
      path: "/tmp/picture.png",
      filename: "picture.png"
    };

    await expect(
      SendWhatsAppMedia({
        media: media as Express.Multer.File,
        ticket: ticket as any,
        userId: 123
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(sendMessage).toHaveBeenCalledWith(
      "5551999999999@c.us",
      { mimetype: "image/png" },
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(99, sendError);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
