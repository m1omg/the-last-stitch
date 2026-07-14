// Who can talk, how they look and how they sound.
// por is a portrait key prefix: resolved as `${por}_${face}` → `${por}_neutral` → `${por}`.

export const SPEAKERS = {
  narrator: { name: null, por: null, blip: 'sfx_blip4', rate: 1.0 },
  poppy: { name: 'Poppy', por: 'por_poppy', blip: 'sfx_blip1', rate: 1.0 },
  buttons: { name: 'Buttons', por: 'por_buttons', blip: 'sfx_blip2', rate: 1.0 },
  captain: { name: 'The Captain', por: 'por_captain', blip: 'sfx_blip3', rate: 1.0 },
  nana: { name: 'Nana Ivy', por: 'por_nana', blip: 'sfx_blip3', rate: 0.8 },
  mum: { name: 'Mum', por: 'por_mum', blip: 'sfx_blip1', rate: 0.85 },
  thimble: { name: 'Mrs. Thimble', por: null, blip: 'sfx_blip2', rate: 0.8 },
  folk: { name: 'Button-folk', por: null, blip: 'sfx_blip2', rate: 1.1 },
  postmoth: { name: 'The Postmoth', por: null, blip: 'sfx_blip1', rate: 1.3 },
  hollow: { name: '……', por: null, blip: 'sfx_blip4', rate: 0.6 },
  fog: { name: 'THE FOG', por: null, blip: 'sfx_blip4', rate: 0.5 },
  sign: { name: null, por: null, blip: 'sfx_blip4', rate: 1.0 },
};
