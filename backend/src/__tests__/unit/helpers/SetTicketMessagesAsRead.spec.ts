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

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

import { getMessengerBot } from "../../../libs/messengerBot";
import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import socketEmit from "../../../helpers/socketEmit";

describe("SetTicketMessagesAsRead", () => {
  const buildTicket = (overrides = {}) =>
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
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  beforeEach(() => {
    (Message.update as jest.Mock).mockResolvedValue([1]);
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 10 });
  });

  it("marks ticket messages as read and emits the refreshed ticket", async () => {
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    const ticket = buildTicket();

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

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
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(ShowTicketService).toHaveBeenCalledWith({ id: 10, tenantId: 5 });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: { id: 10 }
    });
  });

  it("verifies the whatsapp session when sendSeen rejects without blocking the socket update", async () => {
    const error = new Error("disconnected");
    const sendSeen = jest.fn().mockRejectedValue(error);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const ticket = buildTicket();

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(7, error);
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 5,
      type: "ticket:update",
      payload: { id: 10 }
    });

    consoleError.mockRestore();
  });

  it("marks messenger tickets as seen with the messenger bot", async () => {
    const markSeen = jest.fn();
    const ticket = buildTicket({ channel: "messenger" });

    (getMessengerBot as jest.Mock).mockReturnValue({ markSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(markSeen).toHaveBeenCalledWith("messenger-contact");
    expect(GetTicketWbot).not.toHaveBeenCalled();
  });
});
