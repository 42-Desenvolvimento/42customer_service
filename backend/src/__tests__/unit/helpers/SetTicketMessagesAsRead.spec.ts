import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import Message from "../../../models/Message";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import socketEmit from "../../../helpers/socketEmit";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

jest.mock("../../../helpers/socketEmit", () => jest.fn());

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

describe("SetTicketMessagesAsRead", () => {
  const makeTicket = () =>
    ({
      id: 77,
      tenantId: 12,
      channel: "whatsapp",
      whatsappId: 8,
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    (Message.update as jest.Mock).mockResolvedValue([1]);
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 77,
      unreadMessages: 0
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("should mark local WhatsApp messages as read and emit the reloaded ticket", async () => {
    const ticket = makeTicket();
    const sendSeen = jest.fn().mockResolvedValue(undefined);

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

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
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: {
        id: 77,
        unreadMessages: 0
      }
    });
  });

  it("should verify the WhatsApp session when sendSeen rejects", async () => {
    const ticket = makeTicket();
    const error = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(error);

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
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
      payload: {
        id: 77,
        unreadMessages: 0
      }
    });
  });
});
