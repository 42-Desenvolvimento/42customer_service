import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

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

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

describe("SetTicketMessagesAsRead", () => {
  it("should verify the whatsapp session when sendSeen rejects", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReload = { id: 123, unreadMessages: 0 };
    const ticket = {
      id: 123,
      tenantId: 5,
      whatsappId: 9,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5599999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any;
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    (Message.update as jest.Mock).mockResolvedValue([1]);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketReload);

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
    expect(sendSeen).toHaveBeenCalledWith("5599999999999@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      ticket.whatsappId,
      sendSeenError
    );
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleError.mockRestore();
  });
});
