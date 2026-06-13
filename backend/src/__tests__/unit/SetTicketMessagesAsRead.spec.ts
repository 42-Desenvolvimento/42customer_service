import Message from "../../models/Message";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import socketEmit from "../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../models/Message", () => ({
  update: jest.fn()
}));
jest.mock("../../helpers/GetTicketWbot");
jest.mock("../../helpers/socketEmit");
jest.mock("../../services/TicketServices/ShowTicketService");
jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));
jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));
jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

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

  it("should trigger whatsapp session verification when sendSeen fails", async () => {
    const sendSeenError = new Error("session closed");
    const wbot = {
      sendSeen: jest.fn().mockRejectedValue(sendSeenError)
    };
    const reloadedTicket = { id: 15, unreadMessages: 0 };
    const ticket = {
      id: 15,
      tenantId: 5,
      whatsappId: 25,
      channel: "whatsapp",
      isGroup: false,
      contact: { number: "5511777777777" },
      update: jest.fn().mockResolvedValue(undefined)
    };

    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);
    (ShowTicketService as jest.Mock).mockResolvedValue(reloadedTicket);

    await SetTicketMessagesAsRead(ticket as any);
    await new Promise(resolve => setImmediate(resolve));

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 15,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(wbot.sendSeen).toHaveBeenCalledWith("5511777777777@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(25, sendSeenError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 15,
      tenantId: 5
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: reloadedTicket
    });
  });
});
