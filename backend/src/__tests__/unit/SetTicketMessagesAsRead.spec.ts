jest.mock("../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../helpers/socketEmit", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

import Message from "../../models/Message";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import socketEmit from "../../helpers/socketEmit";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies the whatsapp session when sendSeen fails without blocking ticket updates", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReload = { id: 123, unreadMessages: 0 };
    const ticket = {
      id: 123,
      tenantId: 10,
      channel: "whatsapp",
      isGroup: false,
      whatsappId: 55,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    (Message.update as jest.Mock).mockResolvedValue([1]);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

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
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(55, sendSeenError);
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 123,
      tenantId: 10
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 10,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleError.mockRestore();
  });
});

export {};
