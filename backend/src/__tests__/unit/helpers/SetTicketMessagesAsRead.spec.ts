import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import Message from "../../../models/Message";
import { getMessengerBot } from "../../../libs/messengerBot";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";

const mockMessageUpdate = jest.fn();
const mockGetMessengerBot = jest.fn();
const mockShowTicketService = jest.fn();
const mockStartWhatsAppSessionVerify = jest.fn();
const mockGetTicketWbot = jest.fn();
const mockSocketEmit = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: mockMessageUpdate
  }
}));

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: mockGetMessengerBot
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: mockShowTicketService
}));

jest.mock(
  "../../../services/WbotServices/StartWhatsAppSessionVerify",
  () => ({
    StartWhatsAppSessionVerify: mockStartWhatsAppSessionVerify
  })
);

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: mockGetTicketWbot
}));

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: mockSocketEmit
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: mockLoggerWarn
  }
}));

describe("SetTicketMessagesAsRead", () => {
  const ticketReload = { id: 123, unreadMessages: 0 };

  const buildTicket = (overrides = {}) =>
    ({
      id: 123,
      tenantId: 7,
      channel: "whatsapp",
      whatsappId: 44,
      isGroup: false,
      contact: {
        number: "5511999999999",
        messengerId: "messenger-contact"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    mockMessageUpdate.mockResolvedValue([2]);
    mockShowTicketService.mockResolvedValue(ticketReload);
  });

  it("marca mensagens como lidas, zera contador e notifica o ticket recarregado", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    mockGetTicketWbot.mockResolvedValue({ sendSeen });

    const ticket = buildTicket();

    await SetTicketMessagesAsRead(ticket);

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
    expect(GetTicketWbot).toHaveBeenCalledWith(ticket);
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: ticket.id,
      tenantId: ticket.tenantId
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("aciona verificacao de sessao quando o WhatsApp falha ao marcar como lido", async () => {
    const error = new Error("session closed");
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const sendSeen = jest.fn().mockRejectedValue(error);
    mockGetTicketWbot.mockResolvedValue({ sendSeen });

    const ticket = buildTicket({ isGroup: true });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(sendSeen).toHaveBeenCalledWith("5511999999999@g.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      error
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleError.mockRestore();
  });

  it("marca mensagens do Messenger como vistas sem usar sessão WhatsApp", async () => {
    const markSeen = jest.fn();
    mockGetMessengerBot.mockReturnValue({ markSeen });
    const ticket = buildTicket({ channel: "messenger" });

    await SetTicketMessagesAsRead(ticket);

    expect(getMessengerBot).toHaveBeenCalledWith(ticket.whatsappId);
    expect(markSeen).toHaveBeenCalledWith(ticket.contact.messengerId);
    expect(GetTicketWbot).not.toHaveBeenCalled();
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });
});
