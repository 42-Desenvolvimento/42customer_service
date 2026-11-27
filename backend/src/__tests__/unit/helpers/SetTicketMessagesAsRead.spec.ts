import { getMessengerBot } from "../../../libs/messengerBot";
import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import { logger } from "../../../utils/logger";

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => jest.fn());

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

describe("SetTicketMessagesAsRead", () => {
  const buildTicket = (overrides = {}) =>
    ({
      id: 10,
      tenantId: 20,
      whatsappId: 30,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511888888888",
        messengerId: "messenger-contact"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks ticket messages as read and emits the updated ticket", async () => {
    const ticket = buildTicket();
    const ticketReload = { id: ticket.id, unreadMessages: 0 };
    const sendSeen = jest.fn().mockResolvedValue(undefined);

    (Message.update as jest.Mock).mockResolvedValue([2]);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);

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
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
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

  it("tries to recover the WhatsApp session when sendSeen fails", async () => {
    const ticket = buildTicket({ isGroup: true });
    const sendSeenError = new Error("Cannot read property 'sendSeen' of undefined");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    (Message.update as jest.Mock).mockResolvedValue([1]);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: ticket.id });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(sendSeen).toHaveBeenCalledWith("5511888888888@g.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );

    consoleError.mockRestore();
  });

  it("marks messenger conversations as seen", async () => {
    const markSeen = jest.fn();
    const ticket = buildTicket({
      channel: "messenger"
    });

    (Message.update as jest.Mock).mockResolvedValue([1]);
    (getMessengerBot as jest.Mock).mockReturnValue({ markSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: ticket.id });

    await SetTicketMessagesAsRead(ticket);

    expect(markSeen).toHaveBeenCalledWith("messenger-contact");
    expect(GetTicketWbot).not.toHaveBeenCalled();
  });

  it("logs failures without blocking the ticket update event", async () => {
    const ticket = buildTicket();
    const getWbotError = new Error("not initialized");
    const ticketReload = { id: ticket.id };

    (Message.update as jest.Mock).mockResolvedValue([1]);
    (GetTicketWbot as jest.Mock).mockRejectedValue(getWbotError);
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket);

    expect(logger.warn).toHaveBeenCalledWith(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${getWbotError}`
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });
  });
});
