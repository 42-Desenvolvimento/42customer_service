jest.mock("../../../models/Message", () => ({ update: jest.fn() }));
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

import Message from "../../../models/Message";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import socketEmit from "../../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

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

  it("starts WhatsApp session verification when sendSeen rejects", async () => {
    const sendSeenError = new Error("sendSeen failed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReloaded = { id: 12, unreadMessages: 0 };
    const ticket = {
      id: 12,
      tenantId: 34,
      whatsappId: 56,
      channel: "whatsapp",
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    (Message.update as jest.Mock).mockResolvedValue([1]);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReloaded);

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
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@g.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: ticket.id,
      tenantId: ticket.tenantId
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReloaded
    });
  });
});
