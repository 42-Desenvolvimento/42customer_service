import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());
jest.mock("../../../helpers/socketEmit", () => jest.fn());
jest.mock("../../../services/TicketServices/ShowTicketService", () => jest.fn());

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify the WhatsApp session when sendSeen fails asynchronously", async () => {
    const sendSeenError = new Error("Session closed");
    const ticketReload = { id: 10, unreadMessages: 0 };
    const sendSeen = jest.fn().mockReturnValue(Promise.reject(sendSeenError));
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);

    const ticket = {
      id: 10,
      tenantId: 3,
      whatsappId: 55,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();
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
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(55, sendSeenError);
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 10,
      tenantId: 3
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 3,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleErrorSpy.mockRestore();
  });
});
