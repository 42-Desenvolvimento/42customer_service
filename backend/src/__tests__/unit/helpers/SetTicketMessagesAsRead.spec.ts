import { getMessengerBot } from "../../../libs/messengerBot";
import Message from "../../../models/Message";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

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
  const buildTicket = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 10,
      tenantId: 2,
      whatsappId: 99,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511988887777",
        messengerId: "messenger-contact"
      },
      update: jest.fn(),
      ...overrides
    } as any);

  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 10,
      unreadMessages: 0
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("marca mensagens do ticket como lidas e emite atualizacao", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    const ticket = buildTicket();
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 10,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511988887777@c.us");
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 10,
      tenantId: 2
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 2,
      type: "ticket:update",
      payload: {
        id: 10,
        unreadMessages: 0
      }
    });
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("aciona verificacao da sessao quando sendSeen rejeita", async () => {
    const error = new Error("Cannot read property 'sendSeen' of undefined");
    const sendSeen = jest.fn().mockRejectedValue(error);
    const ticket = buildTicket();
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("marcar como lido"),
      error
    );
    expect(socketEmit).toHaveBeenCalled();
  });

  it("usa bot do messenger para marcar mensagem quando canal for messenger", async () => {
    const markSeen = jest.fn();
    const ticket = buildTicket({ channel: "messenger" });
    (getMessengerBot as jest.Mock).mockReturnValue({ markSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(GetTicketWbot).not.toHaveBeenCalled();
    expect(markSeen).toHaveBeenCalledWith("messenger-contact");
    expect(socketEmit).toHaveBeenCalled();
  });
});
