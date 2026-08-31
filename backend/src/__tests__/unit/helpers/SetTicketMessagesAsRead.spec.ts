import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import Message from "../../../models/Message";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import { getMessengerBot } from "../../../libs/messengerBot";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { logger } from "../../../utils/logger";

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

describe("SetTicketMessagesAsRead", () => {
  const mockedMessage = Message as unknown as { update: jest.Mock };
  const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
  const mockedSocketEmit = socketEmit as jest.Mock;
  const mockedGetMessengerBot = getMessengerBot as jest.Mock;
  const mockedShowTicketService = ShowTicketService as jest.Mock;
  const mockedStartWhatsAppSessionVerify =
    StartWhatsAppSessionVerify as jest.Mock;
  const mockedLogger = logger as jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeTicket = (overrides = {}) =>
    ({
      id: 123,
      tenantId: 20,
      whatsappId: 30,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999",
        messengerId: "messenger-contact-id"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  it("should mark unread messages as read and emit the reloaded ticket", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    const ticket = makeTicket();
    const reloadedTicket = {
      id: ticket.id,
      unreadMessages: 0
    };
    mockedGetTicketWbot.mockResolvedValue({ sendSeen });
    mockedShowTicketService.mockResolvedValue(reloadedTicket);

    await SetTicketMessagesAsRead(ticket);

    expect(mockedMessage.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 123,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(mockedShowTicketService).toHaveBeenCalledWith({
      id: 123,
      tenantId: 20
    });
    expect(mockedSocketEmit).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: reloadedTicket
    });
  });

  it("should verify whatsapp session when sendSeen rejects", async () => {
    const sendSeenError = new Error("session closed");
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticket = makeTicket();
    mockedGetTicketWbot.mockResolvedValue({ sendSeen });
    mockedShowTicketService.mockResolvedValue({ id: ticket.id });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      30,
      sendSeenError
    );
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );

    consoleError.mockRestore();
  });

  it("should mark messenger messages as seen", async () => {
    const markSeen = jest.fn();
    const ticket = makeTicket({ channel: "messenger" });
    mockedGetMessengerBot.mockReturnValue({ markSeen });
    mockedShowTicketService.mockResolvedValue({ id: ticket.id });

    await SetTicketMessagesAsRead(ticket);

    expect(mockedGetMessengerBot).toHaveBeenCalledWith(30);
    expect(markSeen).toHaveBeenCalledWith("messenger-contact-id");
    expect(mockedGetTicketWbot).not.toHaveBeenCalled();
  });

  it("should keep emitting the ticket update when channel read integration fails", async () => {
    const ticket = makeTicket();
    const reloadedTicket = {
      id: ticket.id
    };
    mockedGetTicketWbot.mockRejectedValue(new Error("whatsapp unavailable"));
    mockedShowTicketService.mockResolvedValue(reloadedTicket);

    await SetTicketMessagesAsRead(ticket);

    expect(mockedLogger.warn).toHaveBeenCalledWith(
      "Could not mark messages as read. Maybe whatsapp session disconnected? Err: Error: whatsapp unavailable"
    );
    expect(mockedSocketEmit).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: reloadedTicket
    });
  });
});
