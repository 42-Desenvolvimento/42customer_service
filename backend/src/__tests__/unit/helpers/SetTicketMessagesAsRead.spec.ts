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

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should verify the whatsapp session when sendSeen is rejected", async () => {
    const sendSeenError = new Error("Cannot read property 'sendSeen' of undefined");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReload = { id: 10, unreadMessages: 0 };
    const ticket = {
      id: 10,
      tenantId: 20,
      channel: "whatsapp",
      whatsappId: 30,
      isGroup: true,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    (Message.update as jest.Mock).mockResolvedValue([2]);
    (GetTicketWbot as jest.Mock).mockResolvedValue({ sendSeen });
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
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@g.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      30,
      sendSeenError
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 20,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleError.mockRestore();
  });
});
