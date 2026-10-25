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

jest.mock("../../helpers/socketEmit", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import Message from "../../models/Message";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import socketEmit from "../../helpers/socketEmit";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";

describe("SetTicketMessagesAsRead", () => {
  const ticketReload = { id: 123, unreadMessages: 0 };
  const baseTicket = {
    id: 123,
    tenantId: 7,
    whatsappId: 55,
    channel: "whatsapp",
    isGroup: false,
    contact: {
      number: "5511999999999"
    },
    update: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Message.update as jest.Mock).mockResolvedValue([1]);
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);
  });

  it("starts WhatsApp session verification when sendSeen rejects", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await SetTicketMessagesAsRead(baseTicket as any);
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
    expect(baseTicket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(55, sendSeenError);
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 7,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleError.mockRestore();
  });
});
