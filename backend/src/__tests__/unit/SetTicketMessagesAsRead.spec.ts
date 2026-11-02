jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

jest.mock("../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../helpers/socketEmit", () => jest.fn());

import Message from "../../models/Message";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import socketEmit from "../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  const buildTicket = () =>
    ({
      id: 10,
      tenantId: 20,
      channel: "whatsapp",
      whatsappId: 30,
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn()
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 10 });
  });

  it("should verify the WhatsApp session when sendSeen rejects", async () => {
    const ticket = buildTicket();
    const sendSeenError = new Error("Cannot read property 'sendSeen' of undefined");
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const sendSeen = jest.fn().mockReturnValue(Promise.reject(sendSeenError));

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
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
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: { id: 10 }
    });

    consoleError.mockRestore();
  });
});
