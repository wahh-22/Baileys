import { Boom } from '@hapi/boom'
import express, { type Request, type Response } from 'express'
import qrcode from 'qrcode-terminal'
import MAIN_LOGGER from './Utils/logger'
import makeWASocket, { type AnyMessageContent, DisconnectReason, useMultiFileAuthState } from './index'
const app = express()
const port = 3333

app.use(express.json())

const logger = MAIN_LOGGER.child({})
logger.level = 'trace'

interface StartSockFunction {
	(): Promise<ReturnType<typeof makeWASocket>>
	sendMessageWTyping?: (msg: AnyMessageContent, jid: string) => Promise<void>
}

const startSock: StartSockFunction = async () => {
	const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')

	const sock = makeWASocket({
		auth: {
			creds: state.creds,
			keys: state.keys
		}
	})

	startSock.sendMessageWTyping = async (msg: AnyMessageContent, jid: string) => {
		//await sock.presenceSubscribe(jid)
		//await delay(500)

		//await sock.sendPresenceUpdate('composing', jid)
		//await delay(2000)

		//await sock.sendPresenceUpdate('paused', jid)

		await sock.sendMessage(jid, msg)
	}

	sock.ev.process(async events => {
		if (events['connection.update']) {
			const update = events['connection.update']
			const { connection, lastDisconnect, qr } = update

			if (qr) {
				qrcode.generate(qr, { small: true })
			}

			if (connection === 'close') {
				if ((lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
					void startSock()
				} else {
					console.log('Connection closed. You are logged out.')
				}
			}

			console.log('connection update', update)
		}

		if (events['creds.update']) {
			await saveCreds()
		}
	})
	return sock
}

void startSock()
app.get('/', async (_req: Request, res: Response) => {
	console.log('Hello world')
	res.send('Hello world')
})
app.get('/send', async (_req: Request, res: Response) => {
	const message = { text: 'Hello there!' }
	const to = '573173251929@s.whatsapp.net'
	await startSock.sendMessageWTyping!(message, to)
	res.send('Función ejecutada con éxito')
})
app.get('/send-test', async (_req: Request, res: Response) => {
	const to = '573113556070@s.whatsapp.net'
	console.log('recibe send')
	await startSock.sendMessageWTyping!({ text: 'Hello there!' }, to)
	res.send('Función ejecutada con éxito')
})
app.post('/sendAlert', async (req: Request, res: Response) => {
	try {
		const phone = req.body.phone
		const message = req.body.body
		if (!phone || !message) {
			return res.status(400).json({ error: 'Número de teléfono y mensaje requeridos' })
		}

		const msg = { text: message }
		const to = '57' + phone + '@s.whatsapp.net'
		await startSock.sendMessageWTyping!(msg, to)
		res.status(200).json({ message: 'Mensaje enviado correctamente' })
	} catch (error) {
		console.error('Error:', error)
		res.status(500).json({ error: 'Error al enviar el mensaje' })
	}
})
app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}/`)
})
