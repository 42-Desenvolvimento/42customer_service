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

jest.mock("../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

const fs = require("fs");
const { MessageMedia } = require("whatsapp-web.js");
const GetTicketWbot = require("../../helpers/GetTicketWbot") as jest.Mock;
const UserMessagesLog = require("../../models/UserMessagesLog").default;
const { logger } = require("../../utils/logger");
const {
  StartWhatsAppSessionVerify
} = require("../../services/WbotServices/StartWhatsAppSessionVerify");
const SendWhatsAppMedia = require("../../services/WbotServices/SendWhatsAppMedia")
  .default;

describe("SendWhatsAppMedia", () => {
  const media = {
    path: "/tmp/uploaded-audio.ogg",
    filename: "uploaded-audio.ogg"
  } as Express.Multer.File;

  const buildTicket = () =>
    ({
      id: 13,
      whatsappId: 99,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    GetTicketWbot.mockReset();
    MessageMedia.fromFilePath.mockReset();
    UserMessagesLog.create.mockReset();
    logger.error.mockReset();
    StartWhatsAppSessionVerify.mockReset();
    fs.unlinkSync.mockReset();
  });

  it("starts WhatsApp session verification when media sending fails", async () => {
    const sendError = new Error("Session closed");
    const ticket = buildTicket();
    const wbot = {
      sendMessage: jest.fn().mockRejectedValue(sendError)
    };

    GetTicketWbot.mockResolvedValue(wbot);
    MessageMedia.fromFilePath.mockReturnValue({ mimetype: "audio/ogg" });

    await expect(
      SendWhatsAppMedia({
        media,
        ticket,
        userId: 5
      })
    ).rejects.toMatchObject({
      message: "ERR_SENDING_WAPP_MSG"
    });

    expect(wbot.sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "audio/ogg" },
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(99, sendError);
    expect(logger.error).toHaveBeenCalledWith(
      `SendWhatsAppMedia | Error: ${sendError}`
    );
    expect(ticket.update).not.toHaveBeenCalled();
    expect(UserMessagesLog.create).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});

export {};
