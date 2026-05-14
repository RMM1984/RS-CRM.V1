import { error, success } from './response'

const mockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  }

  return res
}

describe('response helpers', () => {
  it('formats success responses', () => {
    const res = mockResponse()

    success(res as never, { id: 1 }, 201)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: { id: 1 } })
  })

  it('formats error responses', () => {
    const res = mockResponse()

    error(res as never, 'Nope', 403)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: { message: 'Nope', details: undefined }
    })
  })
})
