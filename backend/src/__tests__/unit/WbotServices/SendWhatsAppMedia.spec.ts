import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
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

const mockedGetTicketWbot = GetTicketWbot as jest.MockedFunction<
  typeof GetTicketWbot
>;
const mockedFromFilePath = MessageMedia.fromFilePath as jest.Mock;
const mockedUserMessagesLogCreate = UserMessagesLog.create as jest.Mock;
const mockedStartWhatsAppSessionVerify =
  StartWhatsAppSessionVerify as jest.MockedFunction<
    typeof StartWhatsAppSessionVerify
  >;
const mockedUnlinkSync = fs.unlinkSync as jest.Mock;
const mockedLoggerError = logger.error as jest.Mock;

const makeTicket = (overrides = {}) =>
  ({
    id: 123,
    whatsappId: 99,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as any);

const makeMedia = (overrides = {}) =>
  ({
    path: "/tmp/audio.ogg",
    filename: "audio.ogg",
    ...overrides
  } as Express.Multer.File);

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    mockedFromFilePath.mockReturnValue({ mimetype: "audio/ogg" });
    mockedUserMessagesLogCreate.mockResolvedValue({ id: 1 });
    mockedStartWhatsAppSessionVerify.mockResolvedValue();
  });

  it("should send media, update ticket metadata, log user message and remove local file", async () => {
    const sentMessage = { id: { id: "wamid.123" } };
    const sendMessage = jest.fn().mockResolvedValue(sentMessage);
    mockedGetTicketWbot.mockResolvedValue({ sendMessage } as any);

    const ticket = makeTicket();
    const media = makeMedia();

    const response = await SendWhatsAppMedia({
      media,
      ticket,
      userId: 7
    });

    expect(response).toBe(sentMessage);
    expect(mockedFromFilePath).toHaveBeenCalledWith(media.path);
    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(ticket.update).toHaveBeenCalledWith({
      lastMessage: "audio.ogg",
      lastMessageAt: expect.any(Number)
    });
    expect(mockedUserMessagesLogCreate).toHaveBeenCalledWith({
      messageId: "wamid.123",
      userId: 7,
      ticketId: 123
    });
    expect(mockedUnlinkSync).toHaveBeenCalledWith(media.path);
    expect(mockedStartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("should verify whatsapp session and throw business error when media send fails", async () => {
    const sendError = new Error("Session closed");
    mockedGetTicketWbot.mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(sendError)
    } as any);

    const ticket = makeTicket();

    let thrownError: AppError | undefined;
    try {
      await SendWhatsAppMedia({
        media: makeMedia(),
        ticket,
        userId: 7
      });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(AppError);
    expect(thrownError).toMatchObject({
      message: "ERR_SENDING_WAPP_MSG",
      statusCode: 400
    });
    expect(mockedLoggerError).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      99,
      sendError
    );
    expect(mockedUnlinkSync).not.toHaveBeenCalled();
  });
});
