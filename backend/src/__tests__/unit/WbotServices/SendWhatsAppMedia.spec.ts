jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn()
  }
}));

jest.mock("fs", () => ({
  unlinkSync: jest.fn()
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

import fs from "fs";
import { MessageMedia } from "whatsapp-web.js";
import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";

describe("SendWhatsAppMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify the whatsapp session when media sending fails", async () => {
    const sendError = new Error("Session closed");
    const sendMessage = jest.fn().mockRejectedValue(sendError);
    const ticket = {
      id: 123,
      whatsappId: 45,
      contact: {
        number: "5511999999999"
      },
      isGroup: false,
      update: jest.fn()
    };
    const media = {
      filename: "invoice.pdf",
      path: "/tmp/invoice.pdf"
    } as Express.Multer.File;

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });
    (MessageMedia.fromFilePath as jest.Mock).mockReturnValue({
      mimetype: "application/pdf"
    });

    await expect(
      SendWhatsAppMedia({ media, ticket: ticket as any, userId: 10 })
    ).rejects.toBeInstanceOf(AppError);

    expect(sendMessage).toHaveBeenCalledWith(
      "5511999999999@c.us",
      { mimetype: "application/pdf" },
      { sendAudioAsVoice: true }
    );
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(45, sendError);
    expect(ticket.update).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
