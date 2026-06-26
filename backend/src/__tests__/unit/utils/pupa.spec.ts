import { getHours } from "date-fns";
import { pupa } from "../../../utils/pupa";

jest.mock("date-fns", () => ({
  getHours: jest.fn()
}));

const mockedGetHours = getHours as jest.MockedFunction<typeof getHours>;

describe("pupa", () => {
  beforeEach(() => {
    mockedGetHours.mockReset();
  });

  it.each([
    [5, "Olá!"],
    [6, "Bom dia!"],
    [11, "Bom dia!"],
    [12, "Boa Tarde!"],
    [17, "Boa Tarde!"],
    [18, "Boa Noite!"],
    [23, "Boa Noite!"]
  ])("should resolve greeting for hour %s", (hour, expectedGreeting) => {
    mockedGetHours.mockReturnValue(hour);

    expect(pupa("{greeting}", {})).toBe(expectedGreeting);
  });

  it("should recompute greeting on every template interpolation", () => {
    mockedGetHours.mockReturnValueOnce(8).mockReturnValueOnce(19);

    expect(pupa("{greeting}", {})).toBe("Bom dia!");
    expect(pupa("{greeting}", {})).toBe("Boa Noite!");
    expect(mockedGetHours).toHaveBeenCalledTimes(2);
  });

  it("should keep escaping double-braced values while adding greeting", () => {
    mockedGetHours.mockReturnValue(12);

    expect(pupa("Olá {{name}}, {greeting}", { name: "<Ana>" })).toBe(
      "Olá &lt;Ana&gt;, Boa Tarde!"
    );
  });
});
