import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import Ticket from "../../../models/Ticket";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

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

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify whatsapp session and throw AppError when media send fails", async () => {
    const sendError = new Error("send failed");
    const mediaBody = { mimetype: "audio/ogg", data: "base64" };
    const sendMessage = jest.fn().mockRejectedValue(sendError);

    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue(mediaBody);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    const media = {
      path: "/tmp/audio.ogg",
      filename: "audio.ogg"
    } as Express.Multer.File;

    const ticket = {
      id: 9,
      whatsappId: 4,
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    } as unknown as Ticket;

    await expect(
      SendWhatsAppMedia({ media, ticket, userId: 7 })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith("/tmp/audio.ogg");
    expect(sendMessage).toHaveBeenCalledWith("5511888888888@c.us", mediaBody, {
      sendAudioAsVoice: true
    });
    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(4, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
