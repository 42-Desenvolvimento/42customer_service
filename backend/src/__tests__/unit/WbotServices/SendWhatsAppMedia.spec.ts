import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import UserMessagesLog from "../../../models/UserMessagesLog";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

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

describe("SendWhatsAppMedia", () => {
  const media = {
    filename: "proof.pdf",
    path: "/tmp/proof.pdf"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 123,
      whatsappId: 99,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "application/pdf"
    });
  });

  it("should send media, update ticket, create user log and remove local file", async () => {
    const ticket = buildTicket();
    const sentMessage = {
      id: {
        id: "message-id"
      }
    };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    const response = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 456
    });

    expect(response).toBe(sentMessage);
    expect(MessageMedia.fromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "application/pdf" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: expect.any(Number)
    });
    expect(UserMessagesLog.create).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 456,
      ticketId: 123
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(media.path);
  });

  it("should verify whatsapp session before throwing when media send fails", async () => {
    const ticket = buildTicket();
    const error = new Error("send failed");
    (GetTicketWbot as jest.Mock).mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(error)
    });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 456
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(99, error);
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
