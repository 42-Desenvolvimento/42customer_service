import AppError from "../../../errors/AppError";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SendWhatsAppMessage from "../../../services/WbotServices/SendWhatsAppMessage";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../models/UserMessagesLog", () => ({
  __esModule: true,
  default: {
    create: jest.fn()
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("SendWhatsAppMessage", () => {
  const ticket = {
    id: 1,
    whatsappId: 5,
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn()
  };

  beforeEach(() => {
    ticket.update.mockResolvedValue(undefined);
  });

  it("starts session recovery when text sending fails on a closed session", async () => {
    const error = new Error("Session closed");
    const sendMessage = jest.fn().mockRejectedValue(error);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendMessage });

    await expect(
      SendWhatsAppMessage({
        body: "teste",
        ticket: ticket as any
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(5, error);
  });

  it("starts session recovery when the text path has no initialized client", async () => {
    const error = new Error("ERR_WAPP_NOT_INITIALIZED");
    (GetTicketWbot as jest.Mock).mockRejectedValue(error);

    await expect(
      SendWhatsAppMessage({
        body: "teste",
        ticket: ticket as any
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(5, error);
  });
});
