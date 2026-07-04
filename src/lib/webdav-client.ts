export interface WebDAVConfig {
  url: string
  username: string
  password: string
}

export interface WebDAVFile {
  href: string
  name: string
  isDirectory: boolean
  size?: number
  lastModified?: number
  etag?: string
}

function getBasicAuthHeader(username: string, password: string): string {
  const encoded = btoa(`${username}:${password}`)
  return `Basic ${encoded}`
}

function joinUrl(base: string, path: string): string {
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${cleanPath}`
}

function parsePropfindResponse(xmlText: string): WebDAVFile[] {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
  const responses = xmlDoc.getElementsByTagNameNS('DAV:', 'response')
  
  const files: WebDAVFile[] = []
  
  for (let i = 0; i < responses.length; i++) {
    const response = responses[i]
    
    const hrefEl = response.getElementsByTagNameNS('DAV:', 'href')[0]
    const href = hrefEl?.textContent || ''
    
    const propStat = response.getElementsByTagNameNS('DAV:', 'propstat')[0]
    const prop = propStat?.getElementsByTagNameNS('DAV:', 'prop')[0]
    
    if (!prop) continue
    
    const displayNameEl = prop.getElementsByTagNameNS('DAV:', 'displayname')[0]
    const resourcetypeEl = prop.getElementsByTagNameNS('DAV:', 'resourcetype')[0]
    const getContentLengthEl = prop.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]
    const getLastModifiedEl = prop.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]
    const getEtagEl = prop.getElementsByTagNameNS('DAV:', 'getetag')[0]
    
    const isDirectory = resourcetypeEl?.getElementsByTagNameNS('DAV:', 'collection').length !== 0
    
    const name = displayNameEl?.textContent || decodeURIComponent(href.split('/').filter(Boolean).pop() || '')
    
    const size = getContentLengthEl?.textContent 
      ? parseInt(getContentLengthEl.textContent, 10) 
      : undefined
    
    const lastModified = getLastModifiedEl?.textContent 
      ? new Date(getLastModifiedEl.textContent).getTime() 
      : undefined
    
    const etag = getEtagEl?.textContent?.replace(/"/g, '') || undefined
    
    files.push({
      href,
      name,
      isDirectory,
      size,
      lastModified,
      etag,
    })
  }
  
  return files
}

export async function list(config: WebDAVConfig, path: string): Promise<WebDAVFile[]> {
  const url = joinUrl(config.url, path)
  const authHeader = getBasicAuthHeader(config.username, config.password)
  
  const response = await fetch(url, {
    method: 'PROPFIND',
    headers: {
      'Authorization': authHeader,
      'Depth': '1',
    },
  })
  
  if (!response.ok) {
    throw new Error(`WebDAV list failed: ${response.status} ${response.statusText}`)
  }
  
  const xmlText = await response.text()
  const files = parsePropfindResponse(xmlText)
  
  return files.filter(f => f.href !== path && f.href !== `${path}/`)
}

export async function getFile(config: WebDAVConfig, path: string): Promise<Blob> {
  const url = joinUrl(config.url, path)
  const authHeader = getBasicAuthHeader(config.username, config.password)
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
    },
  })
  
  if (!response.ok) {
    throw new Error(`WebDAV getFile failed: ${response.status} ${response.statusText}`)
  }
  
  return await response.blob()
}

export async function putFile(config: WebDAVConfig, path: string, blob: Blob): Promise<void> {
  const url = joinUrl(config.url, path)
  const authHeader = getBasicAuthHeader(config.username, config.password)
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': authHeader,
      'Content-Type': blob.type || 'application/octet-stream',
    },
    body: blob,
  })
  
  if (!response.ok) {
    throw new Error(`WebDAV putFile failed: ${response.status} ${response.statusText}`)
  }
}

export async function deleteFile(config: WebDAVConfig, path: string): Promise<void> {
  const url = joinUrl(config.url, path)
  const authHeader = getBasicAuthHeader(config.username, config.password)
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': authHeader,
    },
  })
  
  if (!response.ok && response.status !== 404) {
    throw new Error(`WebDAV deleteFile failed: ${response.status} ${response.statusText}`)
  }
}

export async function createDir(config: WebDAVConfig, path: string): Promise<void> {
  const url = joinUrl(config.url, path)
  const authHeader = getBasicAuthHeader(config.username, config.password)
  
  const response = await fetch(url, {
    method: 'MKCOL',
    headers: {
      'Authorization': authHeader,
    },
  })
  
  if (!response.ok && response.status !== 405) {
    throw new Error(`WebDAV createDir failed: ${response.status} ${response.statusText}`)
  }
}

export async function exists(config: WebDAVConfig, path: string): Promise<boolean> {
  try {
    const url = joinUrl(config.url, path)
    const authHeader = getBasicAuthHeader(config.username, config.password)
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'Authorization': authHeader,
      },
    })
    
    return response.ok
  } catch {
    return false
  }
}

export async function ensureDir(config: WebDAVConfig, path: string): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  let currentPath = ''
  
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const dirExists = await exists(config, currentPath)
    if (!dirExists) {
      await createDir(config, currentPath)
    }
  }
}
