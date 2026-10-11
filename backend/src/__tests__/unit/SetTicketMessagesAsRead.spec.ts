jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

jest.mock("../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../helpers/socketEmit", () => jest.fn());

import Message from "../../models/Message";
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import socketEmit from "../../helpers/socketEmit";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";

const mockedMessageUpdate = Message.update as jest.Mock;
const mockedShowTicketService = ShowTicketService as jest.Mock;
const mockedStartWhatsAppSessionVerify = StartWhatsAppSessionVerify as jest.Mock;
const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
const mockedSocketEmit = socketEmit as jest.Mock;

describe("SetTicketMessagesAsRead", () => {
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it("marks WhatsApp ticket messages as read and verifies the session when sendSeen fails", async () => {
    const sendSeenError = new Error("Cannot read property 'sendSeen' of undefined");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const ticketReload = { id: 10, unreadMessages: 0 };
    const update = jest.fn().mockResolvedValue(undefined);

    mockedGetTicketWbot.mockResolvedValue({ sendSeen });
    mockedShowTicketService.mockResolvedValue(ticketReload);

    const ticket = {
      id: 10,
      tenantId: 3,
      whatsappId: 7,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511777777777"
      },
      update
    };

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(mockedMessageUpdate).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 10,
          read: false
        }
      }
    );
    expect(update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511777777777@c.us");
    expect(mockedStartWhatsAppSessionVerify).toHaveBeenCalledWith(
      7,
      sendSeenError
    );
    expect(mockedShowTicketService).toHaveBeenCalledWith({
      id: 10,
      tenantId: 3
    });
    expect(mockedSocketEmit).toHaveBeenCalledWith({
      tenantId: 3,
      type: "ticket:update",
      payload: ticketReload
    });
  });
});
