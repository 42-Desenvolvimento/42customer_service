import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import UserMessagesLog from "../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("fs", () => {
  const unlinkSync = jest.fn();

  return {
    __esModule: true,
    default: {
      unlinkSync
    },
    unlinkSync
  };
});

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

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("revalidates the WhatsApp session and raises AppError when media sending fails", async () => {
    const sendMessageError = new Error("send failed");
    const sendMessage = jest.fn().mockRejectedValue(sendMessageError);
    const media = {
      path: "/tmp/audio.ogg",
      filename: "audio.ogg"
    };
    const ticket = {
      id: 10,
      whatsappId: 55,
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    };
    const messageMedia = { mimetype: "audio/ogg" };

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(messageMedia);

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

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@c.us",
      messageMedia,
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      55,
      sendMessageError
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
