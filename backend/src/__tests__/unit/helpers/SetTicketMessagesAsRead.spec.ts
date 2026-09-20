import { getMessengerBot } from "../../../libs/messengerBot";
import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import socketEmit from "../../../helpers/socketEmit";

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
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

describe("SetTicketMessagesAsRead", () => {
  const buildTicket = () =>
    ({
      id: 55,
      tenantId: 2,
      whatsappId: 8,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511888888888",
        messengerId: "messenger-contact"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    (Message.update as jest.Mock).mockResolvedValue([1]);
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 55 });
  });

  it("should mark local messages as read and emit the reloaded ticket", async () => {
    const ticket = buildTicket();
    const sendSeen = jest.fn().mockResolvedValue(undefined);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 55,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 55,
      tenantId: 2
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 2,
      type: "ticket:update",
      payload: { id: 55 }
    });
  });

  it("should verify the WhatsApp session when sendSeen rejects asynchronously", async () => {
    const ticket = buildTicket();
    const sendSeenError = new Error(
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      8,
      sendSeenError
    );
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 2,
      type: "ticket:update",
      payload: { id: 55 }
    });

    consoleError.mockRestore();
  });

  it("should mark messenger messages as seen through the messenger bot", async () => {
    const ticket = {
      ...buildTicket(),
      channel: "messenger"
    };
    const markSeen = jest.fn();
    (getMessengerBot as jest.Mock).mockReturnValue({ markSeen });

    await SetTicketMessagesAsRead(ticket);

    expect(markSeen).toHaveBeenCalledWith("messenger-contact");
    expect(GetTicketWbot).not.toHaveBeenCalled();
  });
});
