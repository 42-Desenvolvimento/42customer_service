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

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/socketEmit", () => ({
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

import Message from "../../../models/Message";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import socketEmit from "../../../helpers/socketEmit";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("SetTicketMessagesAsRead", () => {
  const makeTicket = () =>
    ({
      id: 123,
      tenantId: 456,
      whatsappId: 789,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("marks local messages as read and emits the updated ticket", async () => {
    const ticket = makeTicket();
    const ticketReload = { id: ticket.id, unreadMessages: 0 };
    const sendSeen = jest.fn().mockResolvedValue(undefined);

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket);

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 123,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 456,
      type: "ticket:update",
      payload: ticketReload
    });
    expect(StartWhatsAppSessionVerify).not.toHaveBeenCalled();
  });

  it("verifies the WhatsApp session when sendSeen fails", async () => {
    const ticket = makeTicket();
    const sendSeenError = new Error("Cannot read property 'sendSeen' of undefined");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: ticket.id,
      unreadMessages: 0
    });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(789, sendSeenError);
    expect(console.error).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 456,
      type: "ticket:update",
      payload: {
        id: ticket.id,
        unreadMessages: 0
      }
    });
  });
});
