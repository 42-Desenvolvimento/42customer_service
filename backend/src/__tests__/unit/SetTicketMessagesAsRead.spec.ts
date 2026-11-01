import Message from "../../models/Message";
import { getMessengerBot } from "../../libs/messengerBot";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import socketEmit from "../../helpers/socketEmit";

jest.mock("../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());

jest.mock("../../helpers/socketEmit", () => jest.fn());

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

describe("SetTicketMessagesAsRead", () => {
  const buildTicket = (overrides = {}) =>
    ({
      id: 12,
      tenantId: 34,
      whatsappId: 56,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511888888888",
        messengerId: "messenger-contact"
      },
      update: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (Message.update as jest.Mock).mockResolvedValue([1]);
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 12 });
  });

  it("marks ticket messages as read, emits the reloaded ticket and sends WhatsApp seen", async () => {
    const ticket = buildTicket();
    const wbot = {
      sendSeen: jest.fn().mockResolvedValue(undefined)
    };
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    await SetTicketMessagesAsRead(ticket);

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 12,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(wbot.sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 12,
      tenantId: 34
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 34,
      type: "ticket:update",
      payload: { id: 12 }
    });
  });

  it("verifies the WhatsApp session when sendSeen rejects without interrupting the update flow", async () => {
    const ticket = buildTicket({ isGroup: true });
    const seenError = new Error("sendSeen failed");
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const wbot = {
      sendSeen: jest.fn().mockReturnValue(Promise.reject(seenError))
    };
    (GetTicketWbot as jest.Mock).mockResolvedValue(wbot);

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(wbot.sendSeen).toHaveBeenCalledWith("5511888888888@g.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      seenError
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 34,
      type: "ticket:update",
      payload: { id: 12 }
    });

    consoleError.mockRestore();
  });

  it("marks messenger conversations as seen through Messenger without touching WhatsApp", async () => {
    const ticket = buildTicket({ channel: "messenger" });
    const messengerBot = {
      markSeen: jest.fn()
    };
    (getMessengerBot as jest.Mock).mockReturnValue(messengerBot);

    await SetTicketMessagesAsRead(ticket);

    expect(GetTicketWbot).not.toHaveBeenCalled();
    expect(messengerBot.markSeen).toHaveBeenCalledWith("messenger-contact");
  });
});
