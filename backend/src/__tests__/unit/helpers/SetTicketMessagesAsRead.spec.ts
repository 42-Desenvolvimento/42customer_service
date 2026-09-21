import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("verifies the WhatsApp session when sendSeen is rejected", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockReturnValue(Promise.reject(sendSeenError));
    const ticketReload = { id: 12, unreadMessages: 0 };
    const ticket = {
      id: 12,
      tenantId: 34,
      channel: "whatsapp",
      whatsappId: 56,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    (Message.update as unknown as jest.Mock).mockResolvedValue([1]);
    (GetTicketWbot as unknown as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as unknown as jest.Mock).mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });
  });
});
