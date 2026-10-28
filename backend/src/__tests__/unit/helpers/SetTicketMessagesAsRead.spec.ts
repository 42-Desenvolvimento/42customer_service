import Message from "../../../models/Message";
import { getMessengerBot } from "../../../libs/messengerBot";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import socketEmit from "../../../helpers/socketEmit";

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

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

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

const makeTicket = () =>
  ({
    id: 77,
    tenantId: 3,
    whatsappId: 9,
    channel: "whatsapp",
    isGroup: false,
    contact: {
      number: "551188887777",
      messengerId: "messenger-contact"
    },
    update: jest.fn()
  } as any);

describe("SetTicketMessagesAsRead", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 77 });
    (getMessengerBot as jest.Mock).mockReturnValue({ markSeen: jest.fn() });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("marks unread messages as read and emits the refreshed ticket", async () => {
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
    expect(sendSeen).toHaveBeenCalledWith("551188887777@c.us");
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: { id: 77 }
    });
  });

  it("verifies the WhatsApp session when sendSeen fails asynchronously", async () => {
    const ticket = makeTicket();
    const error = new Error("sendSeen failed");
    const sendSeen = jest.fn().mockRejectedValue(error);

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      error
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      error
    );
    expect(socketEmit).toHaveBeenCalled();
  });
});
