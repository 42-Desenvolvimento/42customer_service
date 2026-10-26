const mockSendSeen = jest.fn();
const mockMarkSeen = jest.fn();

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
  getMessengerBot: jest.fn(() => ({
    markSeen: mockMarkSeen
  }))
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
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import socketEmit from "../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";

const makeTicket = () =>
  ({
    id: 10,
    tenantId: 5,
    channel: "whatsapp",
    whatsappId: 7,
    isGroup: false,
    contact: {
      number: "5511999999999",
      messengerId: "messenger-contact"
    },
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendSeen.mockResolvedValue(undefined);
    (GetTicketWbot as jest.Mock).mockResolvedValue({
      sendSeen: mockSendSeen
    });
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 10,
      unreadMessages: 0
    });
  });

  it("marks unread messages as read and notifies the ticket room", async () => {
    const ticket = makeTicket();

    await SetTicketMessagesAsRead(ticket);

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
    expect(mockSendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 10,
      tenantId: 5
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: {
        id: 10,
        unreadMessages: 0
      }
    });
  });

  it("verifies the WhatsApp session when sendSeen rejects asynchronously", async () => {
    const ticket = makeTicket();
    const error = new Error("session disconnected");
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockSendSeen.mockRejectedValue(error);

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(7, error);
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: {
        id: 10,
        unreadMessages: 0
      }
    });

    consoleError.mockRestore();
  });
});

export {};
