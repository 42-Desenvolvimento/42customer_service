import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import { getMessengerBot } from "../../../libs/messengerBot";
import Message from "../../../models/Message";
import type Ticket from "../../../models/Ticket";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
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
  const ticketReload = { id: 10, unreadMessages: 0 };

  beforeEach(() => {
    jest.clearAllMocks();
    (Message.update as jest.Mock).mockResolvedValue([1]);
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);
  });

  const makeTicket = (overrides: Partial<Ticket> = {}) =>
    ({
      id: 10,
      tenantId: 20,
      whatsappId: 30,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999",
        messengerId: "messenger-contact"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as unknown as Ticket);

  it("should mark database messages read, reset unread count and emit the updated ticket", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    const ticket = makeTicket();
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
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 10,
      tenantId: 20
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: ticketReload
    });
  });

  it("should verify the whatsapp session when sendSeen rejects", async () => {
    const error = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(error);
    const ticket = makeTicket();
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(30, error);
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      error
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleError.mockRestore();
  });

  it("should mark messenger conversations as seen", async () => {
    const markSeen = jest.fn();
    const ticket = makeTicket({ channel: "messenger" });
    (getMessengerBot as jest.Mock).mockReturnValue({ markSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(markSeen).toHaveBeenCalledWith("messenger-contact");
    expect(GetTicketWbot).not.toHaveBeenCalled();
  });

  it("should warn and still emit when channel read confirmation fails synchronously", async () => {
    const error = new Error("wbot not initialized");
    const ticket = makeTicket();
    (GetTicketWbot as jest.Mock).mockRejectedValue(error);

    await SetTicketMessagesAsRead(ticket);

    expect(logger.warn).toHaveBeenCalledWith(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${error}`
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: ticketReload
    });
  });
});

export {};
