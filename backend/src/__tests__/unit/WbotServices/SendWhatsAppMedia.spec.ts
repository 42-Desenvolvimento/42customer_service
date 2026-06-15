import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
const mockedFromFilePath = MessageMedia.fromFilePath as jest.Mock;
const mockedCreateUserMessageLog = UserMessagesLog.create as jest.Mock;
const mockedUnlinkSync = fs.unlinkSync as jest.Mock;
const mockedStartWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;

const media = {
  path: "/tmp/media-file.ogg",
  filename: "media-file.ogg"
} as Express.Multer.File;

const makeTicket = () =>
  ({
    id: 123,
    whatsappId: 7,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should send the media, update the ticket and store the user message log", async () => {
    const ticket = makeTicket();
    jest.spyOn(Date.prototype, "getTime").mockReturnValue(1710000000000);
    const parsedMedia = { mimetype: "audio/ogg" };
    const sentMessage = { id: { id: "message-id" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);

    mockedGetTicketWbot.mockResolvedValue({ sendMessage });
    mockedFromFilePath.mockReturnValue(parsedMedia);
    mockedCreateUserMessageLog.mockResolvedValue(undefined);

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 42
      })
    ).resolves.toBe(sentMessage);

    expect(mockedFromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      parsedMedia,
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: media.filename,
      lastMessageAt: 1710000000000
    });
    expect(mockedCreateUserMessageLog).toHaveBeenCalledWith({
      messageId: "message-id",
      userId: 42,
      ticketId: ticket.id
    });
    expect(mockedUnlinkSync).toHaveBeenCalledWith(media.path);
    expect(mockedStartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("should verify the WhatsApp session and throw an app error when sending fails", async () => {
    const ticket = makeTicket();
    const sendError = new Error("disconnected session");
    const sendMessage = jest.fn().mockRejectedValue(sendError);

    mockedGetTicketWbot.mockResolvedValue({ sendMessage });
    mockedFromFilePath.mockReturnValue({ mimetype: "audio/ogg" });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 42
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendError
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(mockedCreateUserMessageLog).not.toHaveBeenCalled();
    expect(mockedUnlinkSync).not.toHaveBeenCalled();
  });
});
