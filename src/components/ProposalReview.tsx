import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config/database';
import { FaArrowLeft } from 'react-icons/fa';
import '../css/ProposalReview.css'; // Necesitas crear este archivo CSS

interface ProposalData {
    id: number;
    task_id: number;
    applicant_id: number;
    applicant_username: string; // Asumimos que el backend devolverá el nombre del postulante
    message: string;
    portfolio_url?: string; // Opcional
    status: string; // Por ejemplo: 'pending', 'accepted', 'rejected'
    created_at: string;
}

interface TaskData {
    id: number;
    title: string;
    subtitle: string;
    description: string;
    // Otros detalles de la tarea que quieras mostrar en la página de revisión
}

const ProposalReview = () => {
    const { taskId } = useParams<{ taskId: string }>(); // Obtener el ID de la tarea de la URL

    const [task, setTask] = useState<TaskData | null>(null);
    const [proposals, setProposals] = useState<ProposalData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selecting, setSelecting] = useState(false);
    const [selectError, setSelectError] = useState('');
    const [loadingProposals, setLoadingProposals] = useState(true);

    useEffect(() => {
        const fetchTaskAndProposals = async () => {
            setLoading(true);
            setError('');
            try {
                // Obtener detalles de la tarea
                // Asumiendo que tienes un endpoint para obtener detalles de una tarea por ID
                const taskResponse = await axios.get(`${API_URL}/auth/get_task_details.php?task_id=${taskId}`);
                if (taskResponse.data) {
                    setTask(taskResponse.data);
                } else {
                    setError('No se pudieron cargar los detalles de la tarea.');
                }

                // Obtener propuestas para esta tarea
                setLoadingProposals(true);
                console.log('Solicitando propuestas para taskId:', taskId);
                const proposalsResponse = await axios.get(`${API_URL}/auth/get_task_proposals.php?task_id=${taskId}`);
                console.log('Respuesta de propuestas:', proposalsResponse.data);
                
                if (Array.isArray(proposalsResponse.data)) {
                    setProposals(proposalsResponse.data);
                    console.log('Propuestas cargadas:', proposalsResponse.data);
                } else {
                    console.error('Formato de propuestas inesperado:', proposalsResponse.data);
                    setError(prev => prev + ' Formato de datos de propuestas inesperado.');
                    setProposals([]);
                }
            } catch (err: any) {
                console.error('Error completo:', err);
                if (err.response?.status === 404) {
                    setError('Endpoint no encontrado. El backend no tiene implementado get_task_proposals.php');
                } else if (err.response?.status === 500) {
                    setError('Error del servidor. Revisa los logs del backend.');
                } else {
                    setError('Error al cargar la tarea y las propuestas: ' + (err.response?.data?.message || err.message));
                }
            } finally {
                setLoadingProposals(false);
                setLoading(false);
            }
        };

        if (taskId) {
            fetchTaskAndProposals();
        } else {
            setError('ID de tarea no proporcionado.');
            setLoading(false);
        }
    }, [taskId]); // Ejecutar cuando cambie el ID de la tarea en la URL

    const handleSelectProposal = async (proposalId: number) => {
        setSelecting(true);
        setSelectError('');
        try {
            // Endpoint en el backend para seleccionar una propuesta
            // Necesitas crear este script: select_proposal.php
            const response = await axios.post(`${API_URL}/auth/select_proposal.php`, {
                proposal_id: proposalId,
                task_id: taskId // También puedes enviar el ID de la tarea para validación adicional
            }, {
                 headers: { // Incluir el token JWT en el encabezado Authorization para la seguridad del backend
                     Authorization: `Bearer ${localStorage.getItem('token')}`
                 }
            });

            if (response.data && response.data.success) {
                // Simplemente recargar la página para ver los cambios
                window.location.reload();
            } else {
                setSelectError(response.data.message || 'Error al seleccionar la propuesta.');
            }
        } catch (err: any) {
             setSelectError('Error al seleccionar la propuesta: ' + (err.response?.data?.message || err.message));
        } finally {
            setSelecting(false);
        }
    };


    if (loading) {
        return <div className="container"><p>Cargando propuestas...</p></div>;
    }

    if (error) {
        return <div className="container"><p className="error-message">{error}</p></div>;
    }

    return (
        <div className="proposal-review-container">
            <Link to="/dashboard/" className="back-button">
                <FaArrowLeft />
                <span>Volver a Administrar Tareas</span>
            </Link>

            {task && (
                <div className="task-details-card">
                    <h2>Detalles de la Tarea</h2>
                    <h3>{task.title}</h3>
                    <p>{task.subtitle}</p>
                    <p>{task.description}</p>
                    {/* Mostrar otros detalles de la tarea si es necesario */}
                </div>
            )}

            <h2>Propuestas Recibidas ({proposals.length})</h2>

            {selectError && <div className="error-message">{selectError}</div>}

            {loadingProposals ? (
                <div className="loading-proposals">
                    <p>🔄 Cargando propuestas...</p>
                </div>
            ) : proposals.length === 0 ? (
                <div className="no-proposals">
                    <p>📝 No hay propuestas para esta tarea todavía.</p>
                    <p className="proposal-help">Los trabajadores pueden enviar propuestas para esta tarea. Revisa aquí cuando reciban propuestas.</p>
                </div>
            ) : (
                <div className="proposals-list">
                    {proposals.map(proposal => (
                        <div key={proposal.id} className="proposal-item-card">
                            <h3>Propuesta de: {proposal.applicant_username}</h3>
                            <p>{proposal.message}</p>
                            {proposal.portfolio_url && (
                                <p>Portafolio: <a href={proposal.portfolio_url} target="_blank" rel="noopener noreferrer">{proposal.portfolio_url}</a></p>
                            )}
                            <p>Estado: {proposal.status}</p>
                            <p>Enviada el: {new Date(proposal.created_at).toLocaleDateString()}</p>

                            {/* Botón para seleccionar la propuesta */}
                            {proposal.status && typeof proposal.status === 'string' && proposal.status.trim().toLowerCase() === 'pendiente' && ( // Solo mostrar el botón si el estado es 'pendiente' (insensible a mayúsculas y espacios)
                                <button
                                    className="select-proposal-button" // Definir esta clase en CSS
                                    onClick={() => handleSelectProposal(proposal.id)}
                                    disabled={selecting}
                                >
                                    {selecting ? 'Seleccionando...' : 'Seleccionar Propuesta'}
                                </button>
                            )}
                            {/* Puedes añadir más detalles de la propuesta aquí si es necesario */}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProposalReview;