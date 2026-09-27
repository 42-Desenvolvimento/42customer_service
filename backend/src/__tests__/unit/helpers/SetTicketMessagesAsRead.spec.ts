jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
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

import Message from "../../../models/Message";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify the WhatsApp session when sendSeen fails asynchronously", async () => {
    const sendSeenError = new Error("session closed");
    const ticketReload = { id: 10, unreadMessages: 0 };
    const ticket = {
      id: 10,
      tenantId: 4,
      whatsappId: 12,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = {
      sendSeen: jest.fn(() => Promise.reject(sendSeenError))
    };
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    (Message.update as jest.Mock).mockResolvedValue([1]);
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

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
    expect(wbot.sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(12, sendSeenError);
    expect(ShowTicketService).toHaveBeenCalledWith({ id: 10, tenantId: 4 });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 4,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleError.mockRestore();
  });
});
