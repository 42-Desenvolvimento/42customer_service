jest.mock("fs", () => ({
  unlinkSync: jest.fn()
}));

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../models/UserMessagesLog", () => ({
  __esModule: true,
  default: {
    create: jest.fn()
  }
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
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import Ticket from "../../../models/Ticket";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify the WhatsApp session before raising a send error", async () => {
    const error = new Error("ERR_WAPP_NOT_INITIALIZED");
    const sendMessage = jest.fn().mockRejectedValue(error);
    const ticket = {
      id: 12,
      whatsappId: 34,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    } as unknown as Ticket;
    const media = {
      path: "/tmp/audio.ogg",
      filename: "audio.ogg"
    } as Express.Multer.File;

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "audio/ogg"
    });

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 99 })
    ).rejects.toMatchObject({ message: "ERR_SENDING_WAPP_MSG" });

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith(
      "5511888888888@g.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(34, error);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
