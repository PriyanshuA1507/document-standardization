import React, { createContext, useState, useContext, useRef, useEffect, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import api from '../api/axios';

const BulkUploadContext = createContext();

export const useBulkUpload = () => useContext(BulkUploadContext);

export const BulkUploadProvider = ({ children }) => {
  const { enqueueSnackbar } = useSnackbar();

  // -------------------------------------------------------------------------
  // Server-Side Batch State
  // -------------------------------------------------------------------------
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [activeBatch, setActiveBatch] = useState(null);
  const [activeBatchItems, setActiveBatchItems] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'
  const [isStagingBatch, setIsStagingBatch] = useState(false);
  const [stagingDetails, setStagingDetails] = useState('');
  const [uploadTransferProgress, setUploadTransferProgress] = useState(null);
  const [uploadTransferStats, setUploadTransferStats] = useState(null);
  const abortControllerRef = useRef(null);

  // -------------------------------------------------------------------------
  // Legacy / Widget Compatible State
  // -------------------------------------------------------------------------
  const [bulkFilesData, setBulkFilesData] = useState([]);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkPaused, setBulkPaused] = useState(false);
  const [bulkFinished, setBulkFinished] = useState(false);
  const [bulkStartTime, setBulkStartTime] = useState(null);
  const [bulkEndTime, setBulkEndTime] = useState(null);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [isWidgetMinimized, setIsWidgetMinimized] = useState(false);
  const [etaSeconds, setEtaSeconds] = useState(null);

  // References for live updates
  const bulkFilesDataRef = useRef([]);
  const progressRef = useRef(0);
  const totalRef = useRef(0);
  const isPausedRef = useRef(false);
  const currentIndexRef = useRef(0);

  // -------------------------------------------------------------------------
  // SSE Streaming Connection to Server Batch
  // -------------------------------------------------------------------------
  const connectToBatchStream = useCallback((batchId) => {
    if (!batchId) return;

    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);
    setStreamStatus('connecting');

    const streamUrl = `${api.defaults.baseURL || ''}/api/batches/${batchId}/stream`;
    const token = localStorage.getItem('access_token');

    (async () => {
      try {
        const response = await fetch(streamUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`SSE stream failed with status ${response.status}`);
        }

        setStreamStatus('connected');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop(); // Keep incomplete tail

          for (const rawMessage of messages) {
            if (!rawMessage.trim()) continue;

            const lines = rawMessage.split('\n');
            let eventType = 'message';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.substring(7).trim();
              } else if (line.startsWith('data: ')) {
                dataStr = line.substring(6).trim();
              }
            }

            if (!dataStr) continue;

            try {
              const payload = JSON.parse(dataStr);

              // 1. Initial Snapshot Event
              if (eventType === 'snapshot') {
                setActiveBatchId(payload.batch_id);
                setActiveBatch((prev) => ({
                  ...prev,
                  batch_id: payload.batch_id,
                  status: payload.status,
                  total_files: payload.total_files,
                  completed_files: payload.completed_files,
                  failed_files: payload.failed_files,
                }));
                setActiveBatchItems(payload.items || []);

                // Sync to widget state
                setBulkTotal(payload.total_files);
                setBulkProgress(payload.completed_files + payload.failed_files);
                setBulkRunning(payload.status === 'RUNNING');
                setBulkPaused(payload.status === 'PAUSED');
                setBulkFinished(payload.status === 'COMPLETED' || payload.status === 'FAILED');
                if (payload.status === 'RUNNING') setIsWidgetOpen(true);
              }

              // 2. Item Update Event
              else if (eventType === 'item_update') {
                setActiveBatchItems((prev) => {
                  const existingIndex = prev.findIndex(
                    (i) => i.item_id === payload.item_id || i.original_filename === payload.original_filename
                  );
                  if (existingIndex > -1) {
                    const updated = [...prev];
                    updated[existingIndex] = { ...updated[existingIndex], ...payload };
                    return updated;
                  }
                  return [...prev, payload];
                });

                // Update counts on item finish
                if (payload.status === 'SUCCESS' || payload.status === 'FAILED') {
                  setActiveBatch((prev) => {
                    if (!prev) return prev;
                    const comp = payload.status === 'SUCCESS' ? (prev.completed_files || 0) + 1 : prev.completed_files;
                    const fail = payload.status === 'FAILED' ? (prev.failed_files || 0) + 1 : prev.failed_files;
                    setBulkProgress(comp + fail);
                    return { ...prev, completed_files: comp, failed_files: fail };
                  });
                }
              }

              // 3. Batch Update Event
              else if (eventType === 'batch_update') {
                setActiveBatch((prev) => ({
                  ...prev,
                  ...payload,
                }));
                if (payload.status === 'RUNNING') {
                  setBulkRunning(true);
                  setBulkPaused(false);
                  setBulkFinished(false);
                } else if (payload.status === 'PAUSED') {
                  setBulkRunning(false);
                  setBulkPaused(true);
                } else if (payload.status === 'COMPLETED' || payload.status === 'FAILED' || payload.status === 'CANCELLED') {
                  setBulkRunning(false);
                  setBulkPaused(false);
                  setBulkFinished(true);
                  if (payload.status === 'CANCELLED') {
                    // Refresh details so deleted queued items disappear
                    loadBatchDetails(payload.batch_id || activeBatchId);
                  }
                  enqueueSnackbar(`Batch ${payload.status.toLowerCase()}`, {
                    variant: payload.status === 'COMPLETED' ? 'success' : payload.status === 'FAILED' ? 'error' : 'info',
                  });
                }
              }
            } catch (err) {
              console.warn('Error parsing SSE payload', err);
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('SSE stream disconnected:', err.message);
        }
      } finally {
        setIsStreaming(false);
        setStreamStatus('disconnected');
      }
    })();
  }, [enqueueSnackbar]);

  // -------------------------------------------------------------------------
  // Reconnect on Page Load
  // -------------------------------------------------------------------------
  const checkActiveServerBatch = useCallback(async () => {
    try {
      // First check if there is an active running/paused batch
      const res = await api.get('/api/batches', {
        params: { status: 'RUNNING,PAUSED', page_size: 1 },
      });
      const activeBatches = res.data.batches || [];
      if (activeBatches.length > 0) {
        const found = activeBatches[0];
        setActiveBatchId(found.batch_id);
        setActiveBatch(found);
        setIsWidgetOpen(true);
        connectToBatchStream(found.batch_id);
      } else {
        // Otherwise load details of the most recent batch
        const recentRes = await api.get('/api/batches', { params: { page_size: 1 } });
        const recentBatches = recentRes.data.batches || [];
        if (recentBatches.length > 0) {
          const recent = recentBatches[0];
          setActiveBatchId(recent.batch_id);
          setActiveBatch(recent);
          // Load items for display
          loadBatchDetails(recent.batch_id);
        }
      }
    } catch (err) {
      // User might not be logged in yet
    }
  }, [connectToBatchStream]);

  const loadBatchDetails = async (batchId) => {
    if (!batchId) return;
    try {
      const res = await api.get(`/api/batches/${batchId}`);
      setActiveBatch(res.data);
      setActiveBatchItems(res.data.items || []);
      setBulkTotal(res.data.total_files || 0);
      setBulkProgress((res.data.completed_files || 0) + (res.data.failed_files || 0));
      setBulkRunning(res.data.status === 'RUNNING');
      setBulkPaused(res.data.status === 'PAUSED');
      setBulkFinished(res.data.status === 'COMPLETED' || res.data.status === 'FAILED');
    } catch (err) {
      console.error('Failed to load batch details', err);
    }
  };

  useEffect(() => {
    checkActiveServerBatch();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [checkActiveServerBatch]);

  // -------------------------------------------------------------------------
  // Server-Side Batch Control Actions
  // -------------------------------------------------------------------------
  const startServerBatch = async ({
    serverPath,
    files,
    zipFile,
    agencyId,
    concurrency = 4,
    passwordMap = {},
    bulkPasswords = [],
    name,
  }) => {
    setIsStagingBatch(true);
    setStagingDetails(
      zipFile
        ? 'Preparing ZIP archive for server staging...'
        : serverPath
        ? 'Scanning server path and initializing batch...'
        : 'Preparing files for server staging...'
    );
    try {
      let res;
      if (zipFile) {
        // Direct ZIP archive batch
        const formData = new FormData();
        formData.append('file', zipFile);
        if (name) formData.append('name', name);
        if (agencyId) formData.append('agency_id', agencyId);
        formData.append('concurrency', String(concurrency || 4));
        if (passwordMap && Object.keys(passwordMap).length > 0) {
          formData.append('password_map', JSON.stringify(passwordMap));
        }
        if (bulkPasswords && bulkPasswords.length > 0) {
          formData.append('bulk_passwords', JSON.stringify(bulkPasswords));
        }

        setUploadTransferProgress(0);
        setStagingDetails(`Uploading ZIP archive (${(zipFile.size / (1024 * 1024)).toFixed(1)} MB) to server...`);
        res = await api.post('/api/batches/upload-zip', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 0,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadTransferProgress(pct);
              setUploadTransferStats({
                loadedMB: (progressEvent.loaded / (1024 * 1024)).toFixed(1),
                totalMB: (progressEvent.total / (1024 * 1024)).toFixed(1),
              });
              if (pct < 100) {
                setStagingDetails(`Uploading ZIP archive to server: ${pct}%...`);
              } else {
                setStagingDetails('ZIP uploaded! Server is unpacking folders, harvesting passwords, and staging reports...');
              }
            }
          },
        });
      } else if (serverPath) {
        // Server path batch
        setStagingDetails('Analyzing folder and creating batch queue on server...');
        res = await api.post('/api/batches', {
          server_path: serverPath,
          name: name || undefined,
          agency_id: agencyId || undefined,
          concurrency: Number(concurrency) || 4,
          password_map: passwordMap,
          bulk_passwords: bulkPasswords,
        });
      } else if (files && files.length > 0) {
        // Multipart upload batch
        setStagingDetails('Preparing payload for server staging...');
        const formData = new FormData();
        files.forEach((f) => {
          if (f.file) formData.append('files', f.file, f.name);
          else if (f instanceof File) formData.append('files', f, f.name);
        });
        if (name) formData.append('name', name);
        if (agencyId) formData.append('agency_id', agencyId);
        formData.append('concurrency', String(concurrency || 4));
        if (passwordMap && Object.keys(passwordMap).length > 0) {
          formData.append('password_map', JSON.stringify(passwordMap));
        }
        if (bulkPasswords && bulkPasswords.length > 0) {
          formData.append('bulk_passwords', JSON.stringify(bulkPasswords));
        }

        setUploadTransferProgress(0);
        setStagingDetails('Uploading files to server staging (0%)...');
        res = await api.post('/api/batches/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 0,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadTransferProgress(pct);
              setUploadTransferStats({
                loadedMB: (progressEvent.loaded / (1024 * 1024)).toFixed(1),
                totalMB: (progressEvent.total / (1024 * 1024)).toFixed(1),
              });
              if (pct < 100) {
                setStagingDetails(`Uploading files to server staging: ${pct}%...`);
              } else {
                setStagingDetails('Files transferred! Initializing batch records and background worker on server...');
              }
            }
          },
        });
      } else {
        throw new Error('No files or server path provided');
      }

      const newBatch = res.data;
      setActiveBatchId(newBatch.batch_id);
      setActiveBatch(newBatch);
      setActiveBatchItems([]);
      setBulkTotal(newBatch.total_files);
      setBulkProgress(0);
      setBulkRunning(true);
      setBulkPaused(false);
      setBulkFinished(false);
      setIsWidgetOpen(true);
      setIsWidgetMinimized(false);
      setUploadTransferProgress(null);

      enqueueSnackbar(`Batch created with ${newBatch.total_files} files! Processing on server...`, {
        variant: 'success',
      });

      // Connect to SSE stream
      connectToBatchStream(newBatch.batch_id);
      return newBatch;
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to start batch';
      enqueueSnackbar(msg, { variant: 'error' });
      throw err;
    } finally {
      setIsStagingBatch(false);
      setUploadTransferProgress(null);
      setUploadTransferStats(null);
      setStagingDetails('');
    }
  };

  const pauseBatch = async (batchId = activeBatchId) => {
    if (!batchId) return;
    try {
      await api.post(`/api/batches/${batchId}/pause`);
      setActiveBatch((prev) => (prev ? { ...prev, status: 'PAUSED' } : prev));
      setBulkRunning(false);
      setBulkPaused(true);
      enqueueSnackbar('Batch paused', { variant: 'info' });
    } catch (err) {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to pause batch', { variant: 'error' });
    }
  };

  const resumeBatch = async (batchId = activeBatchId) => {
    if (!batchId) return;
    if (activeBatch?.batch_id === batchId && activeBatch?.status === 'CANCELLED') {
      enqueueSnackbar('A cancelled batch cannot be resumed.', { variant: 'error' });
      return;
    }
    try {
      await api.post(`/api/batches/${batchId}/resume`);
      setActiveBatch((prev) => (prev ? { ...prev, status: 'RUNNING' } : prev));
      setBulkRunning(true);
      setBulkPaused(false);
      connectToBatchStream(batchId);
      enqueueSnackbar('Batch resumed', { variant: 'info' });
    } catch (err) {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to resume batch', { variant: 'error' });
    }
  };

  const cancelBatch = async (batchId = activeBatchId) => {
    if (!batchId) return;
    try {
      await api.post(`/api/batches/${batchId}/cancel`);
      setActiveBatch((prev) => (prev ? { ...prev, status: 'CANCELLED' } : prev));
      setBulkRunning(false);
      setBulkPaused(false);
      setBulkFinished(true);
      enqueueSnackbar('Batch cancelled. Unprocessed queued files were deleted.', { variant: 'warning' });
      // Immediately reload details so deleted queued items disappear from activeBatchItems
      await loadBatchDetails(batchId);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to cancel batch', { variant: 'error' });
    }
  };

  const retryFailedBatch = async (batchId = activeBatchId) => {
    if (!batchId) return;
    if (activeBatch?.batch_id === batchId && activeBatch?.status === 'CANCELLED') {
      enqueueSnackbar('A cancelled batch cannot be resumed or retried.', { variant: 'error' });
      return;
    }
    try {
      await api.post(`/api/batches/${batchId}/retry-failed`);
      setActiveBatch((prev) => (prev ? { ...prev, status: 'RUNNING' } : prev));
      setBulkRunning(true);
      setBulkPaused(false);
      setBulkFinished(false);
      connectToBatchStream(batchId);
      enqueueSnackbar('Failed items re-queued for processing', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to retry batch', { variant: 'error' });
    }
  };

  const deleteBatch = async (batchId = activeBatchId) => {
    if (!batchId) return;
    try {
      await api.delete(`/api/batches/${batchId}`);
      if (activeBatchId === batchId) {
        setActiveBatchId(null);
        setActiveBatch(null);
        setActiveBatchItems([]);
        setBulkRunning(false);
        setBulkFinished(false);
        setIsWidgetOpen(false);
      }
      enqueueSnackbar('Batch deleted successfully', { variant: 'success' });
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to delete batch';
      enqueueSnackbar(msg, { variant: 'error' });
      throw err;
    }
  };

  // -------------------------------------------------------------------------
  // Floating Widget Controls
  // -------------------------------------------------------------------------
  const closeWidget = () => setIsWidgetOpen(false);
  const toggleMinimize = () => setIsWidgetMinimized((prev) => !prev);
  const resetBulkState = () => {
    setActiveBatchId(null);
    setActiveBatch(null);
    setActiveBatchItems([]);
    setBulkFilesData([]);
    setBulkProgress(0);
    setBulkTotal(0);
    setBulkRunning(false);
    setBulkFinished(false);
    setBulkPaused(false);
    setIsWidgetOpen(false);
  };

  return (
    <BulkUploadContext.Provider
      value={{
        // Server-Side Batch State & Actions
        activeBatchId,
        activeBatch,
        activeBatchItems,
        isStreaming,
        streamStatus,
        isStagingBatch,
        stagingDetails,
        uploadTransferProgress,
        uploadTransferStats,
        startServerBatch,
        pauseBatch,
        resumeBatch,
        cancelBatch,
        retryFailedBatch,
        deleteBatch,
        loadBatchDetails,
        checkActiveServerBatch,

        // Legacy / Widget State
        bulkFilesData,
        setBulkFilesData,
        bulkProgress,
        bulkTotal,
        bulkRunning,
        bulkFinished,
        setBulkFinished,
        bulkStartTime,
        bulkEndTime,
        isWidgetOpen,
        isWidgetMinimized,
        bulkPaused,
        etaSeconds,
        closeWidget,
        toggleMinimize,
        resetBulkState,

        // Backward compatibility
        startBulkUpload: (filesData, passwordMap, selectedAgency, concurrency, extractedPasswords) => {
          return startServerBatch({
            files: filesData,
            agencyId: selectedAgency,
            concurrency,
            passwordMap,
            bulkPasswords: extractedPasswords,
          });
        },
        pauseBulkUpload: () => pauseBatch(),
        resumeBulkUpload: () => resumeBatch(),
      }}
    >
      {children}
    </BulkUploadContext.Provider>
  );
};
